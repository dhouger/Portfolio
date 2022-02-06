using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using CyfPortal.API.Models;
using CyfPortal.API.Requests;
using ServiceStack;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Web.Configuration;
using System.Windows.Forms;

namespace CyfPortal.API.Services
{
    public class DownloadsService : Service
    {
        private static readonly string DataBase = ConfigurationManager.ConnectionStrings["MongoDBDatabase"].ToString();

        private const string BucketName = "blackboxstocksflowplay";
        private static readonly RegionEndpoint bucketRegion = RegionEndpoint.USEast1;

        private static IAmazonS3 client;
        private static string bucketUrl = "";
        private static Thread thread;
        private static TaskCompletionSource<bool> UrlCreated = new TaskCompletionSource<bool>();

        private static void StartBrowser(string source, int height, int width)
        {
            thread = new Thread(() =>
            {
                var webBrowser = new WebBrowser();
                webBrowser.ScrollBarsEnabled = false;
                webBrowser.DocumentCompleted += webBrowser_DocumentCompleted;
                webBrowser.DocumentText = source;
                webBrowser.Height = height;
                webBrowser.Width = width;
                Application.Run();
            });
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
        }

        private static ImageCodecInfo GetEncoderInfo(String mimeType)
        {
            ImageCodecInfo[] encoders;
            encoders = ImageCodecInfo.GetImageEncoders();
            foreach (var encoder in encoders)
            {
                if (encoder.MimeType == mimeType)
                    return encoder;
            }

            return null;
        }

        // Credit: https://stackoverflow.com/a/17834261/825477
        private static void webBrowser_DocumentCompleted(object sender, WebBrowserDocumentCompletedEventArgs e)
        {
            string imgType = ".png";
            string fileName = Guid.NewGuid().ToString() + imgType;
            string path = @"C:\Users\velar\Documents\" + fileName;

            var webBrowser = (WebBrowser)sender;

            using (Bitmap bitmap = new Bitmap(webBrowser.Width, webBrowser.Height))
            using (var imgStream = new MemoryStream())
            {
                ImageCodecInfo codecInfo = GetEncoderInfo("image/png");
                Encoder encoder;
                EncoderParameter quality;
                EncoderParameters parameters;

                encoder = Encoder.Quality;
                parameters = new EncoderParameters();
                quality = new EncoderParameter(encoder, 100L);
                parameters.Param[0] = quality;
                //parameters.Param[1] = new EncoderParameter(encoder, EncoderValue.CompressionNone);

                webBrowser.DrawToBitmap(bitmap, new Rectangle(0, 0, bitmap.Width, bitmap.Height));
                bitmap.Save(imgStream, codecInfo, parameters);


                // Debugging block; uncomment the precompiler sections to save the image locally
//#if DEBUG
//                using (Bitmap debugImg = new Bitmap(imgStream))
//                {
//                    debugImg.Save(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) + '\\' + fileName, ImageFormat.Png);
//                }
//#else

                AWSCredentials credentials = new BasicAWSCredentials(WebConfigurationManager.AppSettings["AWSAccessKey"], WebConfigurationManager.AppSettings["AWSSecretKey"]);
                client = new AmazonS3Client(credentials, bucketRegion);

                try
                {
                    var putRequest = new PutObjectRequest
                    {
                        BucketName = BucketName,
                        Key = fileName,
                        InputStream = imgStream,
                        ContentType = "image/png",
                        CannedACL = S3CannedACL.PublicRead
                    };

                    PutObjectResponse response = client.PutObject(putRequest);

                    bucketUrl = String.Format(@"https://{0}.s3.{1}.amazonaws.com/{2}", BucketName, bucketRegion.SystemName, fileName);
                }
                catch (Exception ex)
                {
                    // fail silently
                    Console.WriteLine("exception = " + ex.Message);
                }
//#endif
            }
            Application.Exit();

            UrlCreated.TrySetResult(true);
        }

        public async Task<string> Post(PostHTMLToJPGRequest convert)
        {
            string parsedString = HttpUtility.UrlDecode(convert.HTML);

            //HtmlDocument doc = new HtmlDocument;
            StartBrowser(parsedString, convert.Height, convert.Width);
            await UrlCreated.Task;
            UrlCreated = new TaskCompletionSource<bool>();
            var url = bucketUrl;
            bucketUrl = String.Empty;

            return url;
        }

        public List<OptionDownloadFormat> Get(GetCSVHistoricalRequest request)
        {
            try
            {
                DateTime dtfromDate = Convert.ToDateTime(request.FromDate);
                DateTime dttoDate = Convert.ToDateTime(request.ToDate);
                var response = MongoRepository.GetOptionsHistorical(dtfromDate, request.Symbol, 0, dttoDate, request.Filter, request.Filter2, request.FilterSector).OptionAlertsHistorical;

                List<OptionDownloadFormat> list = new List<OptionDownloadFormat>();

                return response.Select(x => x.ToDownloadFormat()).ToList();
            }
            catch (Exception)
            {
                return new List<OptionDownloadFormat>();
            }
        }

        public List<OptionDownloadFormat> Get(GetCSVFlowRequest request)
        {
            try
            {
                DateTime dtRequestedDate = Convert.ToDateTime(request.RequestedDate);
                var response = MongoRepository.GetOptions(dtRequestedDate, request.Symbol, 0, request.Filter, request.Filter2, request.FilterSector);

                List<OptionDownloadFormat> list = new List<OptionDownloadFormat>();

                return response.OptionAlerts.Select(x => x.ToDownloadFormat()).ToList();
            }
            catch (Exception)
            {
                return new List<OptionDownloadFormat>();
            }

        }

        public List<AlertDownloadFormat> Get(GetCSVAlertRequest request)
        {
            try
            {
                DateTime startDate = !String.IsNullOrEmpty(request.AlertStreamStartDate) ? Convert.ToDateTime(request.AlertStreamStartDate) : DateTime.Now.Date;
                DateTime endDate = !String.IsNullOrEmpty(request.AlertStreamEndDate) ? Convert.ToDateTime(request.AlertStreamEndDate) : DateTime.Now.Date;//.AddHours(23).AddMinutes(59).AddSeconds(59);

                if (String.IsNullOrEmpty(request.Symbol))
                {
                    var response = MongoRepository.GetAlertStream(request.Market, request.AlertStreamFilter, startDate.ToShortDateString(), endDate.ToShortDateString(), 0);

                    return response.Select(x => x.ToDownloadFormat()).ToList();
                }
                else
                {
                    var response = MongoRepository.GetAlertStreamBySymbol(request.Symbol, request.Market, request.AlertStreamFilter, startDate.ToShortDateString(), endDate.ToShortDateString(), 0);

                    return response.Select(x => x.ToDownloadFormat()).ToList();
                }
            }
            catch (Exception)
            {

                throw;
            }
        }
    }
}